const generateQR = async (eventCode) => {
    try {
      const url = `${window.location.origin}/event/${eventCode}`;
      const qrDataURL = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Open QR code in new window
      const qrWindow = window.open('', '_blank', 'width=500,height=600');
      qrWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${eventCode}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: #0b0b0d;
                color: white;
                font-family: -apple-system, sans-serif;
              }
              h1 { margin-bottom: 10px; color: #ff6b35; }
              p { margin-bottom: 20px; color: rgba(255,255,255,0.7); }
              img { border: 10px solid white; border-radius: 10px; }
              button {
                margin-top: 20px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #ff006e, #ff4d8f);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <h1>Event QR Code</h1>
            <p>Code: ${eventCode}</p>
            <img src="${qrDataURL}" alt="QR Code" />
            <button onclick="window.print()">Print QR Code</button>
          </body>
        </html>
      `);
    } catch (err) {
      alert('Error generating QR code: ' + err.message);
    }
  };
 </div>
    </div>
  );
}
