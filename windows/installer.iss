; PaperKnowKnow 2.0 - Inno Setup Script
; Bundles: Python embeddable + source + auto pip install

#define MyAppName "PaperKnowKnow"
#define MyAppVersion "2.0"
#define MyAppPublisher "AiKnowKnow"
#define MyAppURL "https://github.com/AiKnowKnow/PaperKnowKnow"

[Setup]
AppId={{B7A3C2D1-E4F5-6789-ABCD-EF0123456789}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=PaperKnowKnow-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
; Python embeddable distribution (must be prepared by build_installer.bat)
Source: "..\dist\python-embed\*"; DestDir: "{app}\python"; Flags: ignoreversion recursesubdirs

; Application source
Source: "..\main.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\ai_analyzer.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\pdf_parser.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\battle.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\requirements.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\static\*"; DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs

; Launcher script
Source: "..\dist\launch.bat"; DestDir: "{app}"; Flags: ignoreversion

; App icon (bundled so shortcuts can reference it)
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

; get-pip.py bootstrap (embeddable Python doesn't include ensurepip)
Source: "..\dist\get-pip.py"; DestDir: "{app}\python"; Flags: ignoreversion deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\launch.bat"; IconFilename: "{app}\icon.ico"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\launch.bat"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
; Bootstrap pip via get-pip.py (embeddable Python lacks ensurepip)
Filename: "{app}\python\python.exe"; Parameters: """{app}\python\get-pip.py"" --no-warn-script-location"; StatusMsg: "Installing pip..."; Flags: runhidden waituntilterminated
Filename: "{app}\python\python.exe"; Parameters: "-m pip install --no-warn-script-location -q -r ""{app}\requirements.txt"""; StatusMsg: "Installing dependencies (may take a few minutes)..."; Flags: runhidden waituntilterminated
; Launch after install
Filename: "{app}\launch.bat"; Description: "Launch PaperKnowKnow"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: dirifempty; Name: "{app}\uploads"
Type: dirifempty; Name: "{app}\library"
Type: dirifempty; Name: "{app}\__pycache__"
