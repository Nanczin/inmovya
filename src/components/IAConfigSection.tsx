import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap,
  TestTube,
  Key,
  Loader2,
  CheckCircle
} from "lucide-react";

interface IAConfig {
  openai_key: string;
  modelo_gpt: string;
  temperatura: number;
  max_tokens: number;
}

interface IAConfigSectionProps {
  config: IAConfig;
  onConfigChange: (config: IAConfig) => void;
}

export function IAConfigSection({ config, onConfigChange }: IAConfigSectionProps) {
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [testResults, setTestResults] = useState<{
    openai?: boolean;
  }>({});
  const { toast } = useToast();

  const handleInputChange = (field: keyof IAConfig, value: string | number) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const testOpenAI = async () => {
    setIsTestingOpenAI(true);
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.openai_key}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTestResults(prev => ({ ...prev, openai: true }));
        toast({
          title: "OpenAI Conectado",
          description: "API Key válida e funcionando!",
          variant: "default",
        });
      } else {
        throw new Error('API Key inválida');
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, openai: false }));
      toast({
        title: "Erro OpenAI",
        description: "API Key inválida ou sem permissões.",
        variant: "destructive",
      });
    } finally {
      setIsTestingOpenAI(false);
    }
  };


  const generateTextSample = async () => {
    if (!config.openai_key) {
      toast({
        title: "Erro",
        description: "Configure a API Key do OpenAI primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openai_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.modelo_gpt,
          messages: [
            {
              role: "system",
              content: "Você é um assistente de vendas imobiliárias especializado em contatos telefônicos."
            },
            {
              role: "user",
              content: "Gere um script de apresentação para uma ligação de prospecção imobiliária."
            }
          ],
          temperature: config.temperatura,
          max_tokens: config.max_tokens
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Script gerado:', data.choices[0].message.content);
        toast({
          title: "Script Gerado",
          description: "Verifique o console para ver o script gerado.",
          variant: "default",
        });
      }
    } catch (error) {
      toast({
        title: "Erro na Geração",
        description: "Não foi possível gerar o script.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          APIs de Inteligência Artificial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            {testResults.openai !== undefined && (
              <CheckCircle 
                className={`w-4 h-4 ${testResults.openai ? 'text-success' : 'text-destructive'}`} 
              />
            )}
          </div>
          <div className="flex gap-2">
            <Input 
              id="openai-key" 
              value={config.openai_key} 
              onChange={(e) => handleInputChange('openai_key', e.target.value)}
              type="password" 
              className="flex-1" 
              placeholder="sk-..."
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={testOpenAI}
              disabled={isTestingOpenAI || !config.openai_key}
            >
              {isTestingOpenAI ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Usado para geração de scripts e análise de sentimento
          </p>
        </div>


        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="gpt-model">Modelo GPT</Label>
            <select 
              id="gpt-model" 
              value={config.modelo_gpt}
              onChange={(e) => handleInputChange('modelo_gpt', e.target.value)}
              className="w-full mt-1 p-2 border border-input rounded-md bg-background"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>
          <div>
            <Label htmlFor="temperatura">Temperatura</Label>
            <Input 
              id="temperatura" 
              value={config.temperatura} 
              onChange={(e) => handleInputChange('temperatura', parseFloat(e.target.value))}
              type="number" 
              step="0.1" 
              min="0" 
              max="2"
              className="mt-1" 
            />
          </div>
          <div>
            <Label htmlFor="max-tokens">Max Tokens</Label>
            <Input 
              id="max-tokens" 
              value={config.max_tokens} 
              onChange={(e) => handleInputChange('max_tokens', parseInt(e.target.value))}
              type="number" 
              min="1"
              max="4000"
              className="mt-1" 
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={generateTextSample}>
            <Key className="w-4 h-4 mr-2" />
            Testar Geração de Script
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}