// Finalization

// Disposable Pattern
// There is also: IAsyncDisposable -- ValueTask DisposeAsync()
// using StreamReader streamReader = new("file1.txt");

public void Dispose()
{
    Dispose(true);
    GC.SuppressFinalize(this);
}

protected virtual void Dispose(bool disposing)
{
    if (_disposed)
    {
        return;
    }

    if (disposing)
    {
        // TODO: dispose managed state (managed objects).
    }

    // TODO: free unmanaged resources (unmanaged objects) and override a finalizer below.
    // TODO: set large fields to null.

    _disposed = true;
}



using System.Runtime.InteropServices.SafeHandle;

internal sealed MySafeHandleSubclass : SafeHandle {
    // Called by P/Invoke when returning SafeHandles
    private MySafeHandleSubclass() : base(IntPtr.Zero, true) {}

    // If & only if you need to support user-supplied handles
    internal MySafeHandleSubclass(IntPtr preexistingHandle, bool ownsHandle) : base(IntPtr.Zero, ownsHandle)
    {
        SetHandle(preexistingHandle);
    }

    // Do not provide a finalizer - SafeHandle's critical finalizer will
    // call ReleaseHandle for you.
    override protected bool ReleaseHandle()
    {
        return MyNativeMethods.CloseHandle(handle);
    }
}


public abstract class SafeHandle : CriticalFinalizerObject, IDisposable
{
    protected IntPtr handle;

    [ReliabilityContract(Consistency.WillNotCorruptState, Cer.MayFail)]
    protected SafeHandle(IntPtr invalidHandleValue, bool ownsHandle)
    {
        handle = invalidHandleValue;

        if (!ownsHandle)
            GC.SuppressFinalize(this);
    }

    [System.Security.SecuritySafeCritical]
    ~SafeHandle() // Syntactic Sugar for System.Object.Finalize
    {
        Dispose(false);
    }

    [System.Security.SecuritySafeCritical]
    [ReliabilityContract(Consistency.WillNotCorruptState, Cer.Success)]
    public void Dispose() {
        Dispose(true);
    }

    [ReliabilityContract(Consistency.WillNotCorruptState, Cer.Success)]
    protected abstract bool ReleaseHandle();

    [System.Security.SecurityCritical]
    [ReliabilityContract(Consistency.WillNotCorruptState, Cer.Success)]
    protected virtual void Dispose(bool disposing)
    {
        if (disposing)
            InternalDispose();
        else
            InternalFinalize();
    }

    [ResourceExposure(ResourceScope.None)]
    [ReliabilityContract(Consistency.WillNotCorruptState, Cer.Success)]
    [MethodImplAttribute(MethodImplOptions.InternalCall)]
    private extern void InternalDispose();

    [ResourceExposure(ResourceScope.None)]
    [ReliabilityContract(Consistency.WillNotCorruptState, Cer.Success)]
    [MethodImplAttribute(MethodImplOptions.InternalCall)]
    extern void InternalFinalize();
}
