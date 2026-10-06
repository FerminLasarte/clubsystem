import datetime as dt
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

Money = Annotated[Decimal, Field(max_digits=12, decimal_places=2, ge=0)]
PositiveMoney = Annotated[Decimal, Field(max_digits=12, decimal_places=2, gt=0)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


def _bcrypt_limit(value: str) -> str:
    # bcrypt usa como máximo 72 bytes: con caracteres multibyte, 72 caracteres pueden ser más.
    if len(value.encode()) > 72:
        raise ValueError("La contraseña es demasiado larga.")
    return value


Password = Annotated[
    str, StringConstraints(min_length=10, max_length=72), AfterValidator(_bcrypt_limit)
]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]


class Schema(BaseModel):
    """Base de los DTOs de salida: se construyen desde objetos ORM."""

    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=200)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class ExportRange(BaseModel):
    """Días locales del club, ambos inclusive (`from` = `to` exporta un solo día)."""

    from_: dt.date = Field(alias="from")
    to: dt.date

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.to < self.from_:
            raise ValueError("`to` no puede ser anterior a `from`.")
        if (self.to - self.from_).days > 366:
            raise ValueError("El rango máximo de exportación es un año.")
        return self
