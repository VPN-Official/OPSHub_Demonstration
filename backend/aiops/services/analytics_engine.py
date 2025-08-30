# Helpers for analytics

def calculate_mttr(workitems):
    if not workitems:
        return 0
    total_minutes = sum(
        [(wi.modified_at - wi.created_at).total_seconds() / 60 for wi in workitems if wi.modified_at]
    )
    return total_minutes / len(workitems)
