from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda name: "".join(
            part.capitalize() if index else part
            for index, part in enumerate(name.split("_"))
        ),
        populate_by_name=True,
        extra="forbid",
    )


class AvailabilityQuery(BaseModel):
    house: Literal["141", "136"]


class AvailabilityResponse(ApiModel):
    house: Literal["141", "136"]
    booked_dates: list[date] = Field(default_factory=list)
    fetched_at: datetime
    range_months: int = Field(ge=1, le=36)
    cached: bool = False


class HealthResponse(ApiModel):
    status: Literal["ok"] = "ok"
    backend: Literal["python-fastapi"] = "python-fastapi"
    configured_houses: list[Literal["141", "136"]]


class ErrorResponse(ApiModel):
    error: str
