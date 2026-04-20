"use client";
import { useState, useRef, useCallback, useEffect } from "react";

export default function QRTool() {
  const [text, setText] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>(null);
  const streamRef = useRef<MediaStream>(null);

  const generateQR = useCallback(async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    try {
      const QRCodeModule = await import("qrcode");
      const url = await QRCodeModule.default.toDataURL(text, { 
        width: 400, 
        margin: 2,
        errorCorrectionLevel: "M"
      });
      setQrUrl(url);
    } catch (error) {
      console.error("Error generando QR:", error);
      alert("Error al generar el QR");
    } finally {
      setIsLoading(false);
    }
  }, [text]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    try {
      const jsQRModule = await import("jsqr");
      const code = jsQRModule.default(imageData.data, imageData.width, imageData.height);

      if (code) {
        setScanResult(code.data);
        stopCamera();
      }
    } catch (error) {
      console.error("Error escaneando frame:", error);
    }
    
    animationRef.current = requestAnimationFrame(scanFrame);
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError("");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        animationRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      console.error("Error accediendo a cámara:", error);
      setCameraError("No se pudo acceder a la cámara. Verifica los permisos.");
    } finally {
      setIsLoading(false);
    }
  }, [scanFrame]);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const processImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona una imagen válida");
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const img = new Image();
        
        img.onload = async () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const jsQRModule = await import("jsqr");
          const code = jsQRModule.default(imageData.data, imageData.width, imageData.height);

          if (code) {
            setScanResult(code.data);
          } else {
            alert("No se detectó ningún código QR en la imagen.");
            setScanResult("");
          }
        };
        
        img.onerror = () => {
          console.error("Error cargando imagen");
          alert("Error al cargar la imagen");
          setIsLoading(false);
        };
        
        img.src = e.target?.result as string;
      } catch (error) {
        console.error("Error procesando imagen:", error);
        alert("Error al procesar la imagen");
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      console.error("Error leyendo archivo");
      setIsLoading(false);
    };
    
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImage(file);
          break;
        }
      }
    }
  }, [processImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  }, [processImage]);

  return (
    <main 
      onPaste={handlePaste} 
      className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        
        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-slate-800">Generador</h2>
          <input
            type="text"
            placeholder="Texto o URL para el QR"
            className="w-full p-3 border rounded-lg mb-4 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateQR()}
          />
          <button 
            onClick={generateQR} 
            disabled={isLoading || !text.trim()}
            className="w-full text-white p-3 rounded-lg !bg-black hover:!bg-gray-950 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Generando..." : "Generar"}
          </button>
          
          {qrUrl && (
            <div className="mt-4 flex justify-center">
              <img 
                src={qrUrl} 
                alt="QR generado" 
                className="border rounded-lg shadow-md max-w-full"
              />
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-dashed border-indigo-100">
          <h2 className="text-xl font-bold mb-4 text-slate-800">Lector</h2>
          <p className="text-sm text-slate-500 mb-4">
            Sube una imagen, pega con <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">Ctrl</kbd>+<kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">V</kbd> o usa la cámara
          </p>
          
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading || isCameraActive}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
            />

            <button
              onClick={isCameraActive ? stopCamera : startCamera}
              disabled={isLoading}
              className={`w-full p-3 rounded-lg text-white transition-colors ${
                isCameraActive 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {isLoading 
                ? "Cargando..." 
                : isCameraActive 
                  ? "Detener cámara" 
                  : "Usar cámara"}
            </button>
          </div>

          {isCameraActive && (
            <div className="mt-4 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg border"
              />
              <div className="absolute inset-0 border-2 border-indigo-500 rounded-lg pointer-events-none" />
            </div>
          )}

          {cameraError && (
            <p className="mt-2 text-sm text-red-600">{cameraError}</p>
          )}

          {scanResult && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-bold text-green-800 uppercase mb-2">Resultado:</p>
              <p className="text-slate-700 break-all font-mono text-sm">{scanResult}</p>
              <button
                onClick={() => navigator.clipboard.writeText(scanResult)}
                className="mt-2 text-xs text-green-700 hover:text-green-900 underline"
              >
                Copiar al portapapeles
              </button>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} className="hidden" />
    </main>
  );
}