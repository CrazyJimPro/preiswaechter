; Beim Deinstallieren den Autostart-Eintrag entfernen. Der Name ist die AppUserModelId aus
; src/main/main.js. Nicht beim Aktualisieren: Das ruft ebenfalls den Deinstaller auf, und
; der Autostart soll dabei erhalten bleiben.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "de.crazyjimpro.preiswaechter"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "de.crazyjimpro.preiswaechter"
  ${endIf}
!macroend
