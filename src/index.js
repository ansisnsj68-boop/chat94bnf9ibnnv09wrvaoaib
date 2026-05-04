export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Serve the Frontend HTML
    if (url.pathname === "/") {
      return new Response(HTML_CONTENT, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 2. Handle POST: Save a new message
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

    // 3. Handle GET: Fetch messages newer than a specific ID
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
        #chat-box { height: 300px; border: 1px solid #ccc; overflow-y: scroll; padding: 10px; margin-bottom: 10px; }
        .msg { margin-bottom: 5px; }
        .author { font-weight: bold; color: #d35400; }
    </style>
</head>
<body>
    <h2>website a is this</h2>
    <div id="setup">
        <input type="text" id="username" placeholder="Enter string to identify yourself">
        <button onclick="joinChat()">Join</button>
    </div>

    <div id="chat-ui" style="display:none;">
        <div id="chat-box"></div>
        <input type="text" id="message" placeholder="Type a communication phrase...">
        <button onclick="sendMessage()">Send</button>
    </div>

    <script>
        let myName = "";
        let lastMessageId = 0;
        let pollInterval;

        async function joinChat() {
            const nameInput = document.getElementById("username").value.trim();
            if (!nameInput) return alert("Please enter a name");
            myName = nameInput;

            // Request Browser Notification Permission
            if (Notification.permission !== "granted") {
                await Notification.requestPermission();
            }

            document.getElementById("setup").style.display = "none";
            document.getElementById("chat-ui").style.display = "block";

            // Start polling every 3 seconds
            pollInterval = setInterval(fetchMessages, 3000);
            fetchMessages(); // Fetch immediately on join
        }

        async function sendMessage() {
            const msgInput = document.getElementById("message");
            const content = msgInput.value.trim();
            if (!content) return;

            msgInput.value = ""; // clear input
            
            await fetch("/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: myName, content: content })
            });
            
            fetchMessages(); // Fetch immediately after sending
        }

        async function fetchMessages() {
            const res = await fetch(\`/messages?lastId=\${lastMessageId}\`);
            const messages = await res.json();

            if (messages.length > 0) {
                const chatBox = document.getElementById("chat-box");
                
                messages.forEach(msg => {
                    // Update the lastId so we don't fetch this message again
                    lastMessageId = Math.max(lastMessageId, msg.id);
                    
                    // Add to UI
                    chatBox.innerHTML += \`<div class="msg"><span class="author">\${msg.username}:</span> \${msg.content}</div>\`;
                    
                    // Trigger Browser Notification if the message isn't from us
                    if (msg.username !== myName && Notification.permission === "granted") {
                        new Notification("New message from " + msg.username, {
                            body: msg.content
                        });
                    }
                });
                
                chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
            }
        }
    </script>
</body>
</html>
`;
