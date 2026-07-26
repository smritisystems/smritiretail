import os
import sys
import time
import shutil
import glob

# Ensure pywin32 is installed or helper is accessible
try:
    import win32print
except ImportError:
    print("Error: 'pywin32' is not installed.")
    print("Please run setup_agent.bat or 'pip install pywin32' first.")
    input("\nPress Enter to exit...")
    sys.exit(1)

CONFIG_FILE = "config.txt"

def load_or_create_config():
    # If config exists, read printer name
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            printer_name = f.read().strip()
            if printer_name:
                return printer_name

    # Otherwise, ask user to select printer
    print("=== SMRITI Retail OS - Barcode Printer Auto-Agent ===")
    print("Listing all installed printers on this system:\n")
    
    printers = []
    # EnumPrinters flags: PRINTER_ENUM_LOCAL = 2, PRINTER_ENUM_CONNECTIONS = 4
    for flags in (win32print.PRINTER_ENUM_LOCAL, win32print.PRINTER_ENUM_CONNECTIONS):
        try:
            for p in win32print.EnumPrinters(flags, None, 1):
                name = p[2]
                if name not in printers:
                    printers.append(name)
        except Exception:
            pass

    if not printers:
        print("No printers found! Please install a printer first.")
        input("\nPress Enter to exit...")
        sys.exit(1)

    for idx, name in enumerate(printers):
        print(f"[{idx + 1}] {name}")

    while True:
        try:
            selection = input(f"\nSelect your barcode printer (1-{len(printers)}): ").strip()
            if not selection:
                continue
            choice = int(selection) - 1
            if 0 <= choice < len(printers):
                selected_printer = printers[choice]
                break
            else:
                print(f"Please enter a number between 1 and {len(printers)}.")
        except ValueError:
            print("Invalid input. Please enter a number.")

    # Save to config file
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        f.write(selected_printer)
        
    print(f"\nSaved printer configuration: '{selected_printer}'")
    time.sleep(1.5)
    return selected_printer

def send_raw_to_printer(printer_name, file_path):
    print(f"Printing: {os.path.basename(file_path)}...")
    try:
        # Read raw print data (ZPL/TSPL)
        with open(file_path, "rb") as f:
            raw_data = f.read()

        # Open printer spooler
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            # Start print document job
            hJob = win32print.StartDocPrinter(hPrinter, 1, ("SMRITI Barcode Print", None, "RAW"))
            try:
                win32print.StartPagePrinter(hPrinter)
                win32print.WritePrinter(hPrinter, raw_data)
                win32print.EndPagePrinter(hPrinter)
            finally:
                win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
        
        print("Sent to printer queue successfully.")
        return True
    except Exception as e:
        print(f"Error printing file: {e}")
        return False

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    printer_name = load_or_create_config()
    
    # Locate Windows Downloads folder
    downloads_dir = os.path.join(os.path.expanduser("~"), "Downloads")
    if not os.path.exists(downloads_dir):
        print(f"Error: Downloads folder not found at '{downloads_dir}'")
        input("\nPress Enter to exit...")
        sys.exit(1)
        
    # Create a subfolder inside Downloads to store printed files
    archive_dir = os.path.join(downloads_dir, "smriti_printed")
    os.makedirs(archive_dir, exist_ok=True)

    print("\n" + "="*50)
    print(" SMRITI Retail OS - Windows Auto Print Agent ")
    print("="*50)
    print(f"Active Printer : {printer_name}")
    print(f"Watching Folder: {downloads_dir}")
    print("Looking for files matching: smriti_barcodes_*.prn")
    print("Status         : Running (Press Ctrl+C to stop)\n")

    try:
        while True:
            # Look for PRN files downloaded from the browser
            pattern = os.path.join(downloads_dir, "smriti_barcodes_*.prn")
            prn_files = glob.glob(pattern)

            for file_path in prn_files:
                # Wait briefly to ensure file is completely written by browser
                time.sleep(0.5)
                
                # Double-check file exists and is not open by another process
                if not os.path.exists(file_path):
                    continue
                    
                # Print it raw
                success = send_raw_to_printer(printer_name, file_path)
                
                if success:
                    # Move to archive folder
                    dest_path = os.path.join(archive_dir, os.path.basename(file_path))
                    # Overwrite if exists in archive
                    if os.path.exists(dest_path):
                        os.remove(dest_path)
                    shutil.move(file_path, dest_path)
                    print(f"Archived to : {dest_path}\n")

            time.sleep(1)

    except KeyboardInterrupt:
        print("\nAuto-print agent stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()
