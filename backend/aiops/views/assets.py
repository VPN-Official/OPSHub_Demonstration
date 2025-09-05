from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.assets import Asset
from ..serializers.assets import AssetSerializer
from ..models.assets import AssetComplianceCertificate, AssetCostTracking

class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer

    @action(detail=True, methods=["get"])
    def compliance_status(self, request, pk=None):
        asset = self.get_object()
        certs = asset.compliance_certificates.all()
        expired = [c.certificate_type for c in certs if c.expiry_date and c.expiry_date.isoformat() < str(asset.modified_at.date())]
        return Response({"expired_certs": expired})

    @action(detail=True, methods=["get"])
    def lifecycle_costs(self, request, pk=None):
        asset = self.get_object()
        ct = getattr(asset, "cost_tracking", None)
        if not ct:
            return Response({})
        return Response({
            "monthly_operating_cost": ct.monthly_operating_cost,
            "ytd_maintenance_cost": ct.ytd_maintenance_cost,
            "insurance_annual": ct.insurance_annual,
        })
