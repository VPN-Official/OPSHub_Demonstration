from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.core import ExternalUser, Team, TeamMembership
from ..serializers.people import ExternalUserSerializer, TeamSerializer, TeamMembershipSerializer

class ExternalUserViewSet(viewsets.ModelViewSet):
    queryset = ExternalUser.objects.all()
    serializer_class = ExternalUserSerializer

    @action(detail=False, methods=["get"])
    def search(self, request):
        skill = request.query_params.get("skill")
        cert = request.query_params.get("certification")
        qs = self.queryset
        if skill:
            qs = qs.filter(skills__contains=[skill])
        if cert:
            qs = qs.filter(certifications__contains=[cert])
        return Response(ExternalUserSerializer(qs, many=True).data)

class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer

    @action(detail=True, methods=["get"])
    def workload(self, request, pk=None):
        team = self.get_object()
        return Response(team.workload_summary or {})

class TeamMembershipViewSet(viewsets.ModelViewSet):
    queryset = TeamMembership.objects.all()
    serializer_class = TeamMembershipSerializer
