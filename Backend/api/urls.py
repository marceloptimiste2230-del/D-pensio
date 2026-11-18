
from django.urls import path

from .auth_views import (
    CurrentUserView,
    LoginView,
    LogoutView,
    RegistrationView,
    csrf_token,
)
from .views import TransactionListCreateView, TransactionRetrieveUpdateDestroyView

urlpatterns = [
    path("auth/csrf/", csrf_token, name="auth-csrf"),
    path("auth/register/", RegistrationView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-current-user"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path('transactions/', TransactionListCreateView.as_view(), name='transaction-list'),
    path(
        'transactions/<uuid:id>/',
        TransactionRetrieveUpdateDestroyView.as_view(),
        name='transaction-detail',
    ),
]
