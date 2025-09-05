from rest_framework import serializers
from ..models.services import BusinessService, ServiceComponent, ServiceComplianceRequirement

class ServiceComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceComponent
        fields = "__all__"

class ServiceComplianceRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceComplianceRequirement
        fields = "__all__"

class BusinessServiceSerializer(serializers.ModelSerializer):
    components = ServiceComponentSerializer(many=True, read_only=True)
    compliance_requirements = ServiceComplianceRequirementSerializer(many=True, read_only=True)

    class Meta:
        model = BusinessService
        fields = "__all__"
