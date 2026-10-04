!define MUI_WELCOMEPAGE_TITLE "Set up YappGG"
!define MUI_WELCOMEPAGE_TEXT "Install YappGG for microphone EQ, presets and ClearCast noise reduction.$\r$\n$\r$\nThe microphone audio components are included. The SteelSeries GG app and VB-CABLE are not required."
!define MUI_FINISHPAGE_TITLE "YappGG is installed"
!define MUI_FINISHPAGE_TEXT "Open YappGG and select your physical microphone.$\r$\n$\r$\nIn Discord, select YappGG Microphone as input and your headphones as output.$\r$\n$\r$\nUse YappGG mute for global processed microphone mute."
!include nsDialogs.nsh
!include FileFunc.nsh
!ifndef BUILD_UNINSTALLER
Var YappUpdating
Var YappSetupDialog
Var YappStartupControl
Var YappDiscordControl
Var YappEnhanceControl
Var YappStartup
Var YappDiscord
Var YappEnhance
Var YappSetupArgs
!macro customInit
  StrCpy $YappUpdating 0
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    StrCpy $YappUpdating 1
  ${EndIf}
  StrCpy $YappStartup 1
  StrCpy $YappDiscord 0
  StrCpy $YappEnhance 0
!macroend
!macro customPageAfterChangeDir
  Page custom YappSetupPage YappSetupLeave
  Function YappSetupPage
    ${If} $YappUpdating == 1
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Microphone setup" "Choose startup and Discord voice enhancement."
    nsDialogs::Create 1018
    Pop $YappSetupDialog
    ${If} $YappSetupDialog == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 10u 100% 18u "Start YappGG with Windows"
    Pop $YappStartupControl
    ${NSD_SetState} $YappStartupControl $YappStartup
    ${NSD_CreateCheckbox} 0 40u 100% 22u "Set YappGG Microphone as default input for Discord"
    Pop $YappDiscordControl
    ${NSD_SetState} $YappDiscordControl $YappDiscord
    ${NSD_CreateCheckbox} 0 68u 100% 22u "Enhance Discord mic settings (restarts Discord)"
    Pop $YappEnhanceControl
    ${NSD_SetState} $YappEnhanceControl $YappEnhance
    ${NSD_CreateLabel} 0 96u 100% 45u "Enhancement disables Discord noise filters, automatic gain and automatic sensitivity so YappGG handles cleanup once. It sets a manual -70 dB threshold. You can revert this in Settings. Settings are backed up. Discord restarts and any active call disconnects. Also available in YappGG Settings."
    Pop $0
    nsDialogs::Show
  FunctionEnd
  Function YappSetupLeave
    ${NSD_GetState} $YappStartupControl $YappStartup
    ${NSD_GetState} $YappDiscordControl $YappDiscord
    ${NSD_GetState} $YappEnhanceControl $YappEnhance
  FunctionEnd
!macroend
!macro customInstall
  ${If} $YappUpdating != 1
  nsExec::ExecToStack '"$INSTDIR\resources\backend-bin\MicBackend.exe" --install-driver'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Microphone driver setup failed: $1"
    Abort
  ${EndIf}
  nsExec::ExecToStack '"$INSTDIR\resources\backend-bin\MicBackend.exe" --brand-adapter'
  Pop $0
  Pop $1
  StrCpy $YappSetupArgs "--install-preferences"
  ${If} $YappStartup != 1
    StrCpy $YappSetupArgs "$YappSetupArgs --no-startup"
  ${EndIf}
  ${If} $YappDiscord == 1
    StrCpy $YappSetupArgs "$YappSetupArgs --discord-setup"
  ${EndIf}
  ${If} $YappEnhance == 1
    StrCpy $YappSetupArgs "$YappSetupArgs --enhance-discord"
  ${EndIf}
  ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\YappGG.exe" "open" "$YappSetupArgs"
  ${EndIf}
!macroend
!endif
!macro customFinishPage
  Function OpenYappGG
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\YappGG.exe" "open" ""
  FunctionEnd
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Open YappGG"
  !define MUI_FINISHPAGE_RUN_FUNCTION "OpenYappGG"
  !insertmacro MUI_PAGE_FINISH
!macroend
