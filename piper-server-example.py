# Exemplo de servidor Piper TTS para integração com Inmovya
# Execute com: uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 180

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import subprocess
import tempfile
import base64
import os

app = FastAPI(title="Piper TTS Server para Inmovya")

# Configurar CORS para aceitar conexões do Inmovya
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todas as origens
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/status")
async def status():
    """Endpoint para verificação de status pelo Inmovya"""
    return {"status": "online", "message": "Piper TTS Server está funcionando", "version": "1.0"}

@app.get("/speak")
async def speak(text: str, voice: str = "pt_BR-cadu-medium"):
    """Gerar áudio usando Piper TTS"""
    try:
        if not text or len(text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Texto é obrigatório")
        
        # Criar arquivo temporário para o áudio
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            temp_audio_path = temp_audio.name
        
        try:
            # Comando Piper (ajuste o caminho conforme sua instalação)
            command = [
                "echo", f'"{text}"', "|", 
                "piper", 
                "--model", f"{voice}.onnx",
                "--output_file", temp_audio_path
            ]
            
            # Executar o comando Piper
            result = subprocess.run(
                f'echo "{text}" | piper --model {voice}.onnx --output_file {temp_audio_path}',
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                raise Exception(f"Erro no Piper: {result.stderr}")
            
            # Ler o arquivo de áudio gerado
            with open(temp_audio_path, "rb") as audio_file:
                audio_data = audio_file.read()
            
            # Converter para base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            return JSONResponse({
                "audio_base64": audio_base64,
                "text": text,
                "voice": voice,
                "success": True
            })
            
        finally:
            # Limpar arquivo temporário
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
                
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Timeout na geração do áudio")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)