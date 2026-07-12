from app.extensions import db
from datetime import datetime, timezone

class SystemRule(db.Model):
    __tablename__ = "system_rules"

    id = db.Column(db.String(50), primary_key=True)
    section = db.Column(db.String(50), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(255), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        val_str = self.value
        if val_str.lower() == "true":
            parsed_val = True
        elif val_str.lower() == "false":
            parsed_val = False
        else:
            try:
                if "." in val_str:
                    parsed_val = float(val_str)
                else:
                    parsed_val = int(val_str)
            except ValueError:
                parsed_val = val_str

        return {
            "id": self.id,
            "section": self.section,
            "label": self.label,
            "value": parsed_val
        }
