using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class InmovyaFileHost
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

    [STAThread]
    private static void Main()
    {
        try
        {
            var request = ReadMessage();
            var action = request.ContainsKey("action") ? Convert.ToString(request["action"]) : "";
            if (action == "pick") PickFiles();
            else if (action == "read") ReadFile(Convert.ToString(request["path"]));
            else WriteMessage(new { ok = false, error = "Ação inválida." });
        }
        catch (Exception error)
        {
            WriteMessage(new { ok = false, error = error.Message });
        }
    }

    private static Dictionary<string, object> ReadMessage()
    {
        var input = Console.OpenStandardInput();
        var lengthBytes = ReadExactly(input, 4);
        var length = BitConverter.ToInt32(lengthBytes, 0);
        var json = Encoding.UTF8.GetString(ReadExactly(input, length));
        return Json.Deserialize<Dictionary<string, object>>(json);
    }

    private static void PickFiles()
    {
        Application.EnableVisualStyles();
        using (var dialog = new OpenFileDialog())
        {
            dialog.Multiselect = true;
            dialog.Filter = "Imagens, vídeos e documentos|*.jpg;*.jpeg;*.png;*.gif;*.webp;*.heic;*.heif;*.mp4;*.mov;*.m4v;*.3gp;*.webm;*.pdf|Todos os arquivos|*.*";
            if (dialog.ShowDialog() != DialogResult.OK)
            {
                WriteMessage(new { ok = true, files = new object[0] });
                return;
            }
            var files = new List<object>();
            foreach (var path in dialog.FileNames)
            {
                var info = new FileInfo(path);
                files.Add(new { path = info.FullName, name = info.Name, size = info.Length, type = MimeType(info.Extension) });
            }
            WriteMessage(new { ok = true, files = files.ToArray() });
        }
    }

    private static void ReadFile(string path)
    {
        if (String.IsNullOrWhiteSpace(path) || !File.Exists(path)) throw new FileNotFoundException("O arquivo original não foi encontrado.", path);
        var info = new FileInfo(path);
        WriteMessage(new { ok = true, @event = "start", name = info.Name, size = info.Length, type = MimeType(info.Extension) });
        using (var stream = File.OpenRead(path))
        {
            // Múltiplo de 3 para que blocos Base64 possam ser concatenados sem
            // preenchimento intermediário corromper o arquivo.
            var buffer = new byte[255 * 1024];
            int read;
            while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
            {
                var data = Convert.ToBase64String(buffer, 0, read);
                WriteMessage(new { ok = true, @event = "chunk", data = data });
            }
        }
        WriteMessage(new { ok = true, @event = "complete", name = info.Name, size = info.Length, type = MimeType(info.Extension) });
    }

    private static string MimeType(string extension)
    {
        switch ((extension ?? "").ToLowerInvariant())
        {
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".png": return "image/png";
            case ".gif": return "image/gif";
            case ".webp": return "image/webp";
            case ".heic": return "image/heic";
            case ".heif": return "image/heif";
            case ".mp4": case ".m4v": return "video/mp4";
            case ".mov": return "video/quicktime";
            case ".3gp": return "video/3gpp";
            case ".webm": return "video/webm";
            case ".pdf": return "application/pdf";
            default: return "application/octet-stream";
        }
    }

    private static byte[] ReadExactly(Stream stream, int length)
    {
        var data = new byte[length];
        var offset = 0;
        while (offset < length)
        {
            var read = stream.Read(data, offset, length - offset);
            if (read <= 0) throw new EndOfStreamException();
            offset += read;
        }
        return data;
    }

    private static void WriteMessage(object value)
    {
        var bytes = Encoding.UTF8.GetBytes(Json.Serialize(value));
        var output = Console.OpenStandardOutput();
        var length = BitConverter.GetBytes(bytes.Length);
        output.Write(length, 0, length.Length);
        output.Write(bytes, 0, bytes.Length);
        output.Flush();
    }
}
