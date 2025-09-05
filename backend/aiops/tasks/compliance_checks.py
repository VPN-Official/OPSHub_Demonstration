from celery import shared_task
from django.utils.timezone import now
from ..models.assets import AssetComplianceCertificate

@shared_task
def run_compliance_checks():
    """Expire outdated compliance certs and return alerts."""
    today = now().date()
    expired = AssetComplianceCertificate.objects.filter(expiry_date__lt=today, status="valid")
    alerts = []
    for cert in expired:
        cert.status = "expired"
        cert.save()
        alerts.append({
            "asset": cert.asset.id,
            "certificate": cert.certificate_type
        })
        print(f"[COMPLIANCE] {cert.certificate_type} expired for Asset {cert.asset.name}")
    return alerts
