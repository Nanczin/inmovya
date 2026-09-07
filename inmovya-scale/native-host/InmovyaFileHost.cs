using System;
using System.Collections.Generic;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
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
            else if (action == "prepare") PrepareFiles(GetPaths(request));
            else if (action == "attach") AttachFilesToOpenDialog(GetPaths(request), IntPtr.Zero);
            else if (action == "activate_attach") ActivateAndAttachFiles(GetPaths(request));
            else if (action == "press_enter") PressEnter();
            else WriteMessage(new { ok = false, error = "Ação inválida." });
        }
        catch (Exception error)
        {
            WriteMessage(new { ok = false, error = error.Message });
        }
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, StringBuilder className, int maxCount);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr window, uint flags);

    private static void AttachFilesToOpenDialog(List<string> paths, IntPtr returnWindow)
    {
        if (paths.Count != 1) throw new InvalidOperationException("Envie um arquivo por vez para o seletor do Windows.");
        var dialog = WaitForFileDialog();
        if (dialog == IntPtr.Zero) throw new InvalidOperationException("O seletor de arquivos do Windows não foi aberto pelo WhatsApp.");
        if (returnWindow == IntPtr.Zero) returnWindow = GetAncestor(dialog, 3);

        SetForegroundWindow(dialog);
        Thread.Sleep(40);
        var selectionDeadline = DateTime.UtcNow.AddSeconds(4);
        var selected = false;
        while (!selected && DateTime.UtcNow < selectionDeadline)
        {
            selected = SelectFileWithAutomation(dialog, paths[0]);
            if (!selected) Thread.Sleep(100);
        }
        if (!selected)
        {
            ShowWindow(dialog, 5);
            SetForegroundWindow(dialog);
            throw new InvalidOperationException("O campo Nome do arquivo ou o botão Abrir não ficou disponível. O envio foi interrompido sem digitar o caminho na conversa.");
        }
        Thread.Sleep(150);
        if (returnWindow != IntPtr.Zero && returnWindow != dialog) SetForegroundWindow(returnWindow);
        WriteMessage(new { ok = true });
    }

    private static void ActivateAndAttachFiles(List<string> paths)
    {
        if (paths.Count != 1) throw new InvalidOperationException("Envie um arquivo por vez para o seletor do Windows.");
        // A tecla enviada pelo Windows é uma ativação real; o WhatsApp rejeita
        // o clique JavaScript no seletor de Fotos e vídeos.
        var returnWindow = GetForegroundWindow();
        SendKeys.SendWait("{ENTER}");
        Thread.Sleep(150);
        AttachFilesToOpenDialog(paths, returnWindow);
    }

    private static void PressEnter()
    {
        SendKeys.SendWait("{ENTER}");
        WriteMessage(new { ok = true });
    }

    private static bool SelectFileWithAutomation(IntPtr dialog, string path)
    {
        try
        {
            var root = AutomationElement.FromHandle(dialog);
            var edits = root.FindAll(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
            AutomationElement fileNameField = null;

            foreach (AutomationElement edit in edits)
            {
                var id = edit.Current.AutomationId ?? "";
                var name = edit.Current.Name ?? "";
                if (id == "1148" || IsInsideFileNameControl(edit) ||
                    id.IndexOf("FileName", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("Nome do arquivo", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("File name", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    fileNameField = edit;
                    break;
                }
            }

            if (fileNameField == null)
            {
                for (var index = edits.Count - 1; index >= 0; index--)
                {
                    var edit = edits[index];
                    var id = edit.Current.AutomationId ?? "";
                    var name = edit.Current.Name ?? "";
                    var identity = (id + " " + name).ToLowerInvariant();
                    if (identity.Contains("address") || identity.Contains("endereço") ||
                        identity.Contains("search") || identity.Contains("pesquisar")) continue;
                    object ignoredPattern;
                    if (edit.TryGetCurrentPattern(ValuePattern.Pattern, out ignoredPattern))
                    {
                        fileNameField = edit;
                        break;
                    }
                }
            }

            object valueObject;
            if (fileNameField == null ||
                !fileNameField.TryGetCurrentPattern(ValuePattern.Pattern, out valueObject)) return false;
            ((ValuePattern)valueObject).SetValue(path);

            var buttons = root.FindAll(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
            AutomationElement openButton = null;
            foreach (AutomationElement button in buttons)
            {
                var id = button.Current.AutomationId ?? "";
                var name = button.Current.Name ?? "";
                if (id == "1" || name.Equals("Abrir", StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("Open", StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("Selecionar", StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("Choose", StringComparison.OrdinalIgnoreCase))
                {
                    openButton = button;
                    break;
                }
            }

            object invokeObject;
            if (openButton == null ||
                !openButton.TryGetCurrentPattern(InvokePattern.Pattern, out invokeObject)) return false;
            // O campo e o botão já foram encontrados. Somente agora esconda a
            // janela, evitando que o Windows perca os controles do seletor.
            ShowWindow(dialog, 0);
            ((InvokePattern)invokeObject).Invoke();
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsInsideFileNameControl(AutomationElement element)
    {
        var walker = TreeWalker.ControlViewWalker;
        var current = element;
        for (var depth = 0; depth < 4 && current != null; depth++)
        {
            var id = current.Current.AutomationId ?? "";
            var name = current.Current.Name ?? "";
            if (id.IndexOf("FileName", StringComparison.OrdinalIgnoreCase) >= 0 ||
                name.IndexOf("Nome do arquivo", StringComparison.OrdinalIgnoreCase) >= 0 ||
                name.IndexOf("File name", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            current = walker.GetParent(current);
        }
        return false;
    }

    private static IntPtr WaitForFileDialog()
    {
        var deadline = DateTime.UtcNow.AddSeconds(8);
        while (DateTime.UtcNow < deadline)
        {
            var window = GetForegroundWindow();
            var className = new StringBuilder(256);
            GetClassName(window, className, className.Capacity);
            if (className.ToString() == "#32770") return window;
            Thread.Sleep(25);
        }
        return IntPtr.Zero;
    }

    private static List<string> GetPaths(Dictionary<string, object> request)
    {
        var paths = new List<string>();
        object value;
        if (!request.TryGetValue("paths", out value) || value == null) return paths;
        var enumerable = value as IEnumerable;
        if (enumerable == null || value is string) return paths;
        foreach (var item in enumerable)
        {
            var path = Convert.ToString(item);
            if (!String.IsNullOrWhiteSpace(path)) paths.Add(path);
        }
        return paths;
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

    private static void PrepareFiles(List<string> paths)
    {
        if (paths.Count == 0) throw new InvalidOperationException("Nenhum arquivo foi informado.");
        CleanupPreparedFiles();
        var files = new List<object>();
        foreach (var path in paths)
        {
            if (!File.Exists(path)) throw new FileNotFoundException("O arquivo original não foi encontrado.", path);
            var preparedPath = IsVideo(path) ? ConvertVideo(path) : Path.GetFullPath(path);
            var info = new FileInfo(preparedPath);
            files.Add(new { path = info.FullName, name = info.Name, size = info.Length, type = MimeType(info.Extension) });
        }
        WriteMessage(new { ok = true, files = files.ToArray() });
    }

    private static bool IsVideo(string path)
    {
        var extension = Path.GetExtension(path).ToLowerInvariant();
        return new[] { ".mp4", ".mov", ".m4v", ".3gp", ".webm", ".avi", ".mkv" }.Contains(extension);
    }

    private static string ConvertVideo(string sourcePath)
    {
        var hostDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        var ffmpegPath = Path.Combine(hostDirectory, "ffmpeg.exe");
        if (!File.Exists(ffmpegPath)) throw new FileNotFoundException("Conversor de vídeo não instalado. Execute novamente o instalador da Inmovya Scale.", ffmpegPath);

        var preparedRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InmovyaScale", "Prepared");
        var outputDirectory = Path.Combine(preparedRoot, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(outputDirectory);
        var safeName = String.Join("_", Path.GetFileNameWithoutExtension(sourcePath).Split(Path.GetInvalidFileNameChars()));
        if (String.IsNullOrWhiteSpace(safeName)) safeName = "video";
        var outputPath = Path.Combine(outputDirectory, safeName + ".mp4");

        var arguments = "-hide_banner -loglevel error -y -i " + Quote(sourcePath) +
            " -map 0:v:0 -map 0:a:0? -vf " + Quote("scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2") +
            " -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart " + Quote(outputPath);
        var startInfo = new ProcessStartInfo
        {
            FileName = ffmpegPath,
            Arguments = arguments,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true
        };
        using (var process = Process.Start(startInfo))
        {
            var error = process.StandardError.ReadToEnd();
            process.WaitForExit();
            if (process.ExitCode != 0 || !File.Exists(outputPath))
            {
                try { Directory.Delete(outputDirectory, true); } catch { }
                throw new InvalidOperationException("Não foi possível converter o vídeo: " + error.Trim());
            }
        }
        return outputPath;
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    private static void CleanupPreparedFiles()
    {
        var preparedRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InmovyaScale", "Prepared");
        if (!Directory.Exists(preparedRoot)) return;
        foreach (var directory in Directory.GetDirectories(preparedRoot))
        {
            try
            {
                if (Directory.GetCreationTimeUtc(directory) < DateTime.UtcNow.AddDays(-2)) Directory.Delete(directory, true);
            }
            catch { }
        }
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
            case ".doc": return "application/msword";
            case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case ".xls": return "application/vnd.ms-excel";
            case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case ".ppt": return "application/vnd.ms-powerpoint";
            case ".pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case ".txt": return "text/plain";
            case ".csv": return "text/csv";
            case ".zip": return "application/zip";
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
