from rest_framework import serializers
from ..models.core import ExternalUser, Team, TeamMembership

class ExternalUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalUser
        fields = "__all__"

class TeamMembershipSerializer(serializers.ModelSerializer):
    user = ExternalUserSerializer(read_only=True)

    class Meta:
        model = TeamMembership
        fields = "__all__"

class TeamSerializer(serializers.ModelSerializer):
    memberships = TeamMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = "__all__"
