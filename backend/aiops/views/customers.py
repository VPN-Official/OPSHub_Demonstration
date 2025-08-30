from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.customers import Customer
from ..models.contracts import Contract
from ..models.vendors import Vendor
from ..serializers.customers import CustomerSerializer, ContractSerializer, VendorSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    @action(detail=True, methods=["get"])
    def escalation_contacts(self, request, pk=None):
        customer = self.get_object()
        return Response(CustomerSerializer(customer).data["escalation_contacts"])

class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer

    @action(detail=True, methods=["get"])
    def sla_targets(self, request, pk=None):
        contract = self.get_object()
        return Response(ContractSerializer(contract).data["sla_targets"])

    @action(detail=True, methods=["get"])
    def penalties(self, request, pk=None):
        contract = self.get_object()
        return Response(ContractSerializer(contract).data["penalty_clauses"])

class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer

    @action(detail=True, methods=["get"])
    def certifications(self, request, pk=None):
        vendor = self.get_object()
        return Response(vendor.certifications or [])
