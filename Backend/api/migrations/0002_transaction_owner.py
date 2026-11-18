from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def ensure_existing_transactions_have_owners(apps, schema_editor):
    Transaction = apps.get_model("api", "Transaction")
    unowned_transactions = Transaction.objects.using(
        schema_editor.connection.alias
    ).filter(owner__isnull=True)
    if unowned_transactions.exists():
        raise RuntimeError(
            "Existing transactions need an owner before applying this migration."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="owner",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="transactions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            ensure_existing_transactions_have_owners,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="transaction",
            name="owner",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="transactions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
