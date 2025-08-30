from rest_framework import serializers
from ..models.analytics import AnalyticsMetric, FinancialImpact

class AnalyticsMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsMetric
        fields = "__all__"

class FinancialImpactSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialImpact
        fields = "__all__"
