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
Var YappDriverFailed
Var YappDriverPendingRestart
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
  StrCpy $YappDriverFailed 0
  StrCpy $YappDriverPendingRestart 0
  nsExec::ExecToStack '"$INSTDIR\resources\backend-bin\MicBackend.exe" --install-driver'
  Pop $0
  Pop $1
  ${If} $0 == 3010
    StrCpy $YappDriverPendingRestart 1
    DetailPrint "Windows marked the microphone driver as pending reboot. Setup will not restart the PC."
    ReadEnvStr $3 "PROGRAMDATA"
    CreateDirectory "$3\YappGG"
    FileOpen $2 "$3\YappGG\driver-pending-reboot.txt" w
    FileWrite $2 "Windows requested a reboot to activate the microphone driver. YappGG setup will not restart your PC."
    FileClose $2
  ${ElseIf} $0 != 0
    StrCpy $YappDriverFailed 1
    ReadEnvStr $3 "PROGRAMDATA"
    CreateDirectory "$3\YappGG"
    FileOpen $2 "$3\YappGG\driver-install.log" w
    FileWrite $2 "$1"
    FileClose $2
    DetailPrint "Microphone driver setup needs repair. Log: $3\YappGG\driver-install.log"
    IfSilent +2
    MessageBox MB_ICONEXCLAMATION "YappGG files are installed, but Windows could not finish microphone driver setup. Use Settings > Repair microphone. Setup will not restart your PC. Details: $3\YappGG\driver-install.log"
  ${EndIf}
  ${If} $YappDriverFailed == 0
  ${AndIf} $YappDriverPendingRestart == 0
  nsExec::ExecToStack '"$INSTDIR\resources\backend-bin\MicBackend.exe" --brand-adapter'
  Pop $0
  Pop $1
  ${EndIf}
  StrCpy $YappSetupArgs "--install-preferences"
  ${If} $YappStartup != 1
    StrCpy $YappSetupArgs "$YappSetupArgs --no-startup"
  ${EndIf}
  ${If} $YappDiscord == 1
  ${AndIf} $YappDriverFailed == 0
  ${AndIf} $YappDriverPendingRestart == 0
    StrCpy $YappSetupArgs "$YappSetupArgs --discord-setup"
  ${EndIf}
  ${If} $YappEnhance == 1
    StrCpy $YappSetupArgs "$YappSetupArgs --enhance-discord"
  ${EndIf}
  SetRebootFlag false
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
