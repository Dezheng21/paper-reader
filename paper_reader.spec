# -*- mode: python ; coding: utf-8 -*-
import os, sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

# Collect everything uvicorn and fastapi need (they use dynamic imports heavily)
uvicorn_datas, uvicorn_binaries, uvicorn_hiddenimports = collect_all('uvicorn')
fastapi_datas, fastapi_binaries, fastapi_hiddenimports = collect_all('fastapi')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=uvicorn_binaries + fastapi_binaries,
    datas=[
        ('static', 'static'),                      # bundled web UI
        *uvicorn_datas,
        *fastapi_datas,
    ],
    hiddenimports=[
        *uvicorn_hiddenimports,
        *fastapi_hiddenimports,
        *collect_submodules('uvicorn'),
        *collect_submodules('fastapi'),
        'anthropic',
        'openai',
        'google.genai',
        'google.genai.types',
        'fitz',                                    # PyMuPDF
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
    upx=True,
    console=False,
    icon=_icon_icns if _is_mac else _icon_ico,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='PaperReader',
)

# BUNDLE block is only processed by PyInstaller on macOS
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
        },
    )
