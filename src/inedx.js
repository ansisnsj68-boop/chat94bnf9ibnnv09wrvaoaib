export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(HTML_CONTENT, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (request.method === "POST" && url.pathname === "/messages") {
      const { username, content } = await request.json();
      
      if (!username || !content) {
        return new Response("Missing fields", { status: 400 });
      }

      await env.DB.prepare(
        "INSERT INTO messages (username, content) VALUES (?, ?)"
      ).bind(username, content).run();

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    if (request.method === "GET" && url.pathname === "/messages") {
      const lastId = url.searchParams.get("lastId") || 0;
      
      const { results } = await env.DB.prepare(
        "SELECT * FROM messages WHERE id > ? ORDER BY id ASC LIMIT 50"
      ).bind(lastId).all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

// --- FRONTEND CODE ---
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>this is a website</title>
    <style>
        body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; }
        
        /* The chat box is now hidden by default */
        #chat-box { 
            height: 300px; 
            border: 1px solid #ccc; 
            overflow-y: scroll; 
            padding: 10px; 
            margin-bottom: 10px; 
            display: none; 
        }
        
        .msg { margin-bottom: 5px; }
        .author { font-weight: bold; color: #d35400; }
        
        /* Styling for the new reveal button */
        #reveal-btn {
            margin-bottom: 10px;
            padding: 10px;
            background-color: #eee;
            border: 1px solid #aaa;
            cursor: pointer;
            user-select: none; /* Prevents text highlighting while holding */
        }
    </style>
</head>
<body>
    <h2>wesite a is this</h2>
    
    <div id="setup">
        <input type="text" id="username" placeholder="Enter your name">
        <button onclick="joinChat()">Join Chat</button>
    </div>

    <div id="chat-ui" style="display:none;">
        <button id="reveal-btn">Hold to view logs</button>
        <div id="chat-box"></div>
        <input type="text" id="message" placeholder="Type a message...">
        <button onclick="sendMessage()">Send</button>
    </div>

    <script>
        let myName = "";
        let lastMessageId = 0;
        let pollInterval;

        const chatBox = document.getElementById("chat-box");
        const revealBtn = document.getElementById("reveal-btn");

        // --- HOLD TO REVEAL LOGIC ---
        // Mouse controls
        revealBtn.addEventListener("mousedown", () => chatBox.style.display = "block");
        revealBtn.addEventListener("mouseup", () => chatBox.style.display = "none");
        revealBtn.addEventListener("mouseleave", () => chatBox.style.display = "none"); // Hides if you drag the mouse off the button
        
        // Touch controls (for screens)
        revealBtn.addEventListener("touchstart", (e) => { 
            e.preventDefault(); // Stops the screen from zooming/scrolling
            chatBox.style.display = "block"; 
        });
        revealBtn.addEventListener("touchend", () => chatBox.style.display = "none");


        async function joinChat() {
            const nameInput = document.getElementById("username").value.trim();
            if (!nameInput) return alert("Please enter a name");
            myName = nameInput;

            if (Notification.permission !== "granted") {
                await Notification.requestPermission();
            }

            document.getElementById("setup").style.display = "none";
            document.getElementById("chat-ui").style.display = "block";

            pollInterval = setInterval(fetchMessages, 3000);
            fetchMessages(); 
        }

        async function sendMessage() {
            const msgInput = document.getElementById("message");
            const content = msgInput.value.trim();
            if (!content) return;

            msgInput.value = ""; 
            
            await fetch("/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: myName, content: content })
            });
            
            fetchMessages(); 
        }

        async function fetchMessages() {
            const res = await fetch(\`/messages?lastId=\${lastMessageId}\`);
            const messages = await res.json();

            if (messages.length > 0) {
                messages.forEach(msg => {
                    lastMessageId = Math.max(lastMessageId, msg.id);
                    chatBox.innerHTML += \`<div class="msg"><span class="author">\${msg.username}:</span> \${msg.content}</div>\`;
                    
                    if (msg.username !== myName && Notification.permission === "granted") {
                        new Notification("New message from " + msg.username, {
                            body: msg.content
                        });
                    }
                });
                chatBox.scrollTop = chatBox.scrollHeight; 
            }
        }
    </script>
</body>
</html>
`;
