from ..models import ExchangeName
from .base import ExchangeConnector
from .binance import BinanceConnector
from .bitget import BitgetConnector
from .bybit import BybitConnector

CONNECTORS = {
    ExchangeName.binance: BinanceConnector,
    ExchangeName.bybit: BybitConnector,
    ExchangeName.bitget: BitgetConnector,
}


def get_connector(exchange: ExchangeName, api_key: str, api_secret: str, passphrase: str = None) -> ExchangeConnector:
    cls = CONNECTORS[exchange]
    return cls(api_key=api_key, api_secret=api_secret, passphrase=passphrase)
