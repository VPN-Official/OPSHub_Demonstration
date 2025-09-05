from rest_framework import serializers
from ..models.logs import SystemLog, SystemLogCorrelation

class SystemLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemLog
        fields = "__all__"

class SystemLogCorrelationSerializer(serializers.ModelSerializer):
    log = SystemLogSerializer(read_only=True)

    class Meta:
        model = SystemLogCorrelation
        fields = "__all__"
