from django.apps import AppConfig

class AiopsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "aiops"
    verbose_name = "AI Native Operations Platform"

    def ready(self):
        # Place to connect signals or preload logic
        try:
            import aiops.tasks  # noqa
        except ImportError:
            pass
