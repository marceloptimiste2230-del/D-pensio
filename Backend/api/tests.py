from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Transaction


User = get_user_model()


class TransactionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password="StrongPass123!",
        )
        self.client.force_login(self.user)

    def test_create_and_list_transactions(self):
        response = self.client.post(
            reverse("transaction-list"),
            {"text": "Salaire", "amount": "125000.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["text"], "Salaire")
        self.assertEqual(response.data["amount"], "125000.00")

        list_response = self.client.get(reverse("transaction-list"))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], response.data["id"])
        self.assertEqual(
            Transaction.objects.get(id=response.data["id"]).owner,
            self.user,
        )

    def test_reject_transaction_without_description(self):
        response = self.client.post(
            reverse("transaction-list"),
            {"text": "", "amount": "1000.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Transaction.objects.count(), 0)

    def test_delete_transaction(self):
        transaction = Transaction.objects.create(
            owner=self.user,
            text="Courses",
            amount="-2500.00",
        )

        response = self.client.delete(
            reverse("transaction-detail", kwargs={"id": transaction.id})
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Transaction.objects.filter(id=transaction.id).exists())

    def test_anonymous_user_cannot_access_transactions(self):
        self.client.logout()

        response = self.client.get(reverse("transaction-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_cannot_access_another_users_transaction(self):
        transaction = Transaction.objects.create(
            owner=self.user,
            text="Privée",
            amount="-500.00",
        )
        other_user = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="StrongPass456!",
        )
        self.client.force_login(other_user)

        list_response = self.client.get(reverse("transaction-list"))
        detail_response = self.client.get(
            reverse("transaction-detail", kwargs={"id": transaction.id})
        )
        delete_response = self.client.delete(
            reverse("transaction-detail", kwargs={"id": transaction.id})
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data, [])
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Transaction.objects.filter(id=transaction.id).exists())


class AuthenticationApiTests(APITestCase):
    def test_registration_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        payload = {
            "email": "csrf@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }

        rejected_response = client.post(
            reverse("auth-register"),
            payload,
            format="json",
        )
        self.assertEqual(
            rejected_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        csrf_response = client.get(reverse("auth-csrf"))
        accepted_response = client.post(
            reverse("auth-register"),
            payload,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_response.json()["csrfToken"],
        )

        self.assertEqual(accepted_response.status_code, status.HTTP_201_CREATED)

    def test_register_and_login_with_email(self):
        register_response = self.client.post(
            reverse("auth-register"),
            {
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )

        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(register_response.data["email"], "new@example.com")
        self.assertEqual(
            self.client.get(reverse("auth-current-user")).status_code,
            status.HTTP_200_OK,
        )

        self.client.logout()
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": "NEW@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.get(reverse("auth-current-user")).data["email"],
            "new@example.com",
        )

    def test_reject_registration_with_mismatched_passwords(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "DifferentPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_logout_ends_the_session(self):
        user = User.objects.create_user(
            username="logout@example.com",
            email="logout@example.com",
            password="StrongPass123!",
        )
        self.client.force_login(user)

        logout_response = self.client.post(reverse("auth-logout"))
        current_user_response = self.client.get(reverse("auth-current-user"))

        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(
            current_user_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
