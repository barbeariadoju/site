' Sobe o contador de clientes na cadeira junto com o Windows, sem abrir janela preta.
' Recriado em 03/09/2026: o arquivo original se perdeu na formatacao, e por isso o
' contador parou de subir sozinho (ultimo heartbeat: 01/09 13h26).
' O 0 no segundo argumento esconde a janela; False = nao espera terminar.
CreateObject("WScript.Shell").Run """" & CreateObject("WScript.Shell").ExpandEnvironmentStrings("%USERPROFILE%") & "\barbearia-camera\start-counter.bat""", 0, False
