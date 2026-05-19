# -*- mode: python ; coding: utf-8 -*-
import os, sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

uvicorn_datas, uvicorn_binaries, uvicorn_hiddenimports = collect_all('uvicorn')
fastapi_datas, fastapi_binaries, fastapi_hiddenimports = collect_all('fastapi')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=uvicorn_binaries + fastapi_binaries,
    datas=[
        ('static', 'static'),
        *uvicorn_datas,
        *fastapi_datas,
    ],
    hiddenimports=[
        *uvicorn_hiddenimports,
        *fastapi_hiddenimports,
        'anthropic',
        'openai',
        'google.genai',
        'google.genai.types',
        'fitz',
        'multipart',
        'python_multipart',
        'starlette',
        'starlette.middleware',
        'starlette.middleware.cors',
        'pydantic',
        'pydantic.v1',
        'anyio',
        'anyio.abc',
        'anyio._backends._asyncio',
        'anyio._backends._trio',
        'httpx',
        'email.mime.multipart',
        'email.mime.text',
        'tkinter',
        'tkinter.ttk',
        '_tkinter',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

_icon_icns = 'icon.icns' if os.path.exists('icon.icns') else None
_icon_ico  = 'icon.ico'  if os.path.exists('icon.ico')  else None
_is_mac    = sys.platform == 'darwin'

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='PaperReader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,              # UPX decompression on SSD is slower than plain read
    console=False,          # no terminal window on Windows or Mac
    icon=_icon_icns if _is_mac else _icon_ico,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,              # keep all DLLs/PYDs uncompressed for faster cold start
    upx_exclude=[],
    name='PaperReader',
)

if _is_mac:
    app = BUNDLE(
        coll,
        name='论文阅读助手.app',
        icon=_icon_icns,
        bundle_identifier='com.paperreader.app',
        info_plist={
            'NSHighResolutionCapable': True,
            'LSUIElement': False,
            'CFBundleShortVersionString': '1.0.0',
            'NSRequiresAquaSystemAppearance': False,
            'CFBundleDisplayName': '论文阅读助手',
            'CFBundleName': '论文阅读助手',
        },
    )
