from rest_framework import serializers
from ..models.governance import OperationalCategory, ChangeRequest, RiskRegister

class OperationalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OperationalCategory
        fields = "__all__"

class ChangeRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeRequest
        fields = "__all__"

class RiskRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskRegister
        fields = "__all__"
