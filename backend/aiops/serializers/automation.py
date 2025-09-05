from rest_framework import serializers
from ..models.automation import AutomationRule, AutomationTriggerCondition, AutomationExecutionStep, AutomationExecutionLog

class AutomationTriggerConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationTriggerCondition
        fields = "__all__"

class AutomationExecutionStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationExecutionStep
        fields = "__all__"

class AutomationRuleSerializer(serializers.ModelSerializer):
    trigger_conditions = AutomationTriggerConditionSerializer(many=True, read_only=True)
    execution_steps = AutomationExecutionStepSerializer(many=True, read_only=True)

    class Meta:
        model = AutomationRule
        fields = "__all__"

class AutomationExecutionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationExecutionLog
        fields = "__all__"
