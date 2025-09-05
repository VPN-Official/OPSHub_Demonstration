from rest_framework import serializers
from ..models.customers import Customer, CustomerEscalationContact
from ..models.contracts import Contract, SLATarget, PenaltyClause
from ..models.vendors import Vendor

class CustomerEscalationContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerEscalationContact
        fields = "__all__"

class CustomerSerializer(serializers.ModelSerializer):
    escalation_contacts = CustomerEscalationContactSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = "__all__"

class SLATargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLATarget
        fields = "__all__"

class PenaltyClauseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PenaltyClause
        fields = "__all__"

class ContractSerializer(serializers.ModelSerializer):
    sla_targets = SLATargetSerializer(many=True, read_only=True)
    penalty_clauses = PenaltyClauseSerializer(many=True, read_only=True)

    class Meta:
        model = Contract
        fields = "__all__"

class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = "__all__"
