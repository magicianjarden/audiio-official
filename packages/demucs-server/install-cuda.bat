@echo off
echo =============================================
echo Installing PyTorch with CUDA 12.4 for RTX 5070
echo =============================================
echo.

REM Uninstall existing CPU-only PyTorch
pip uninstall torch torchaudio -y

REM Install CUDA-enabled PyTorch (CUDA 12.4 for RTX 50 series)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

echo.
echo =============================================
echo Verifying CUDA installation...
echo =============================================
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA version: {torch.version.cuda}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"

echo.
echo If CUDA shows True above, restart the Demucs server!
pause
