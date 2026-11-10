using System.Runtime.InteropServices;

namespace MouseCheese;

static class Clicker
{
    const uint InputMouse = 0;
    const uint LeftDown = 0x0002;
    const uint LeftUp = 0x0004;

    public static void LeftClick()
    {
        if (Send(LeftDown) != 1)
            throw new InvalidOperationException("Windows no dejó pulsar el botón del ratón.");
        Thread.Sleep(30);
        if (Send(LeftUp) != 1)
            throw new InvalidOperationException("Windows no dejó soltar el botón del ratón.");
    }

    public static bool IsOver(IntPtr hwnd)
    {
        if (!GetCursorPos(out var point) || !GetWindowRect(hwnd, out var rect))
            return false;
        return point.X >= rect.Left && point.X < rect.Right && point.Y >= rect.Top && point.Y < rect.Bottom;
    }

    static uint Send(uint flag)
    {
        var input = new INPUT
        {
            type = InputMouse,
            mi = new MOUSEINPUT { dwFlags = flag },
        };
        return SendInput(1, [input], Marshal.SizeOf<INPUT>());
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT
    {
        public uint type;
        public MOUSEINPUT mi;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
}
