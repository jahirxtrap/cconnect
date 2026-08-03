"""Request models for the network router."""

from typing import Optional

from pydantic import BaseModel


class WifiConnectRequest(BaseModel):
    ssid: str
    password: Optional[str] = None


class RadioRequest(BaseModel):
    enabled: bool


class InterfaceRequest(BaseModel):
    name: str
    enabled: bool


class SudoRequest(BaseModel):
    password: Optional[str] = None
