from rest_framework import serializers
from ..models.assets import Asset, AssetConfigurationItem, AssetComplianceCertificate, AssetCostTracking

class AssetConfigurationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetConfigurationItem
        fields = "__all__"

class AssetComplianceCertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetComplianceCertificate
        fields = "__all__"

class AssetCostTrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetCostTracking
        fields = "__all__"

class AssetSerializer(serializers.ModelSerializer):
    configuration_items = AssetConfigurationItemSerializer(many=True, read_only=True)
    compliance_certificates = AssetComplianceCertificateSerializer(many=True, read_only=True)
    cost_tracking = AssetCostTrackingSerializer(read_only=True)

    class Meta:
        model = Asset
        fields = "__all__"
