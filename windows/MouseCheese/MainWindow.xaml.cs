using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Graphics;
using WinRT.Interop;

namespace MouseCheese;

public sealed partial class MainWindow : Window
{
    private CancellationTokenSource? _run;
    private int _seconds = 30;

    public MainWindow()
    {
        InitializeComponent();
        AppWindow.Resize(new SizeInt32(520, 640));
        Closed += (_, _) => _run?.Cancel();
    }

    void Toggle_Click(object sender, RoutedEventArgs e)
    {
        if (_run != null)
            Stop();
        else
            Start();
    }

    void Start()
    {
        _seconds = SelectedSeconds();
        IntervalBox.IsEnabled = false;
        ToggleButton.Content = "Detener";
        StatusText.Text = $"El primer clic es en {_seconds} s. Apartá el puntero de esta ventana.";
        var queue = DispatcherQueue.GetForCurrentThread();
        _run = new CancellationTokenSource();
        _ = RunAsync(queue, _run.Token);
    }

    void Stop()
    {
        _run?.Cancel();
        _run = null;
        IntervalBox.IsEnabled = true;
        ToggleButton.Content = "Comenzar";
        StatusText.Text = "En espera";
    }

    async Task RunAsync(DispatcherQueue queue, CancellationToken token)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_seconds));
            while (await timer.WaitForNextTickAsync(token))
                queue.TryEnqueue(Tick);
        }
        catch (OperationCanceledException)
        {
        }
    }

    void Tick()
    {
        if (_run == null)
            return;

        var hwnd = WindowNative.GetWindowHandle(this);
        if (Clicker.IsOver(hwnd))
        {
            StatusText.Text = "Salté el clic: el puntero está sobre esta ventana.";
            return;
        }

        try
        {
            Clicker.LeftClick();
            StatusText.Text = $"Clic a las {DateTime.Now:T}. El próximo es en {_seconds} s.";
        }
        catch (Exception error)
        {
            Stop();
            StatusText.Text = error.Message;
        }
    }

    int SelectedSeconds()
    {
        if (IntervalBox.SelectedItem is ComboBoxItem item &&
            int.TryParse(item.Tag?.ToString(), out var seconds))
            return seconds;
        return 30;
    }
}
