import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if speech recognition is available (Web Speech API)
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsAvailable(!!SpeechRecognition);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          // Use final transcript if available, otherwise use interim
          const resultText = finalTranscript.trim() || interimTranscript;
          if (resultText) {
            setTranscript(resultText);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setError(event.error || "Speech recognition error");
          setIsListening(false);
          logger.error("Speech recognition error", event.error, { event });
        };

        recognitionRef.current = recognition;
      }
    } else {
      // Not available on native platforms without additional setup
      setIsAvailable(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  const startListening = async () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not available");
      return;
    }

    try {
      setTranscript("");
      setError(null);
      recognitionRef.current.start();
    } catch (err) {
      setError("Failed to start speech recognition");
      logger.error("Failed to start speech recognition", err);
    }
  };

  const stopListening = async () => {
    if (!recognitionRef.current) {
      return;
    }

    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (err) {
      logger.error("Failed to stop speech recognition", err);
    }
  };

  const cancelListening = async () => {
    if (!recognitionRef.current) {
      return;
    }

    try {
      recognitionRef.current.abort();
      setIsListening(false);
      setTranscript("");
    } catch (err) {
      logger.error("Failed to cancel speech recognition", err);
    }
  };

  return {
    isListening,
    transcript,
    error,
    isAvailable,
    startListening,
    stopListening,
    cancelListening,
  };
}
