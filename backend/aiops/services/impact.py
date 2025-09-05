# Business impact calculator

def calculate_business_impact(work_item, duration_minutes=0):
    service = getattr(work_item, "business_service", None)
    if not service:
        return {"downtime_minutes": duration_minutes, "revenue_loss": 0.0}

    hourly_loss = float(service.revenue_impact_per_hour or 0)
    revenue_loss = (duration_minutes / 60.0) * hourly_loss
    return {
        "downtime_minutes": duration_minutes,
        "revenue_loss": revenue_loss,
    }
