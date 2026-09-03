@echo off
REM Contador de clientes na cadeira (v29.46.0). Caminhos atualizados em 03/09/2026:
REM a formatacao trocou o usuario do Windows de "julia" para "Barbearia" e este .bat
REM continuava apontando para a pasta antiga, entao o contador nunca mais subiu.
REM %USERPROFILE% no lugar do caminho fixo para nao quebrar de novo numa proxima troca.
cd /d "%USERPROFILE%\barbearia-camera"
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" chair_counter.py >> counter.out 2>&1
