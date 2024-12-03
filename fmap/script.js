        const infoButton = document.getElementById("infoButton");
        const infoPopup = document.getElementById("infoPopup");
        const closePopup = document.getElementById("closePopup");
        const canvas = document.getElementById("forceCanvas");
        const ctx = canvas.getContext("2d");
        const forcesContainer = document.getElementById("forcesContainer");
        const addForceButton = document.getElementById("addForce");
        const removeForceButton = document.getElementById("removeForce");
        const labelInput = document.getElementById("labelInput");
        const downloadButton = document.getElementById("download");
        const downloadJSONButton = document.getElementById("downloadJSON");
        const uploadJSONInput = document.getElementById("uploadJSON");
        const darkModeToggle = document.getElementById("darkModeToggle");
        const jsonInputField = document.getElementById("jsonInputField");
        const loadJSONButton = document.getElementById("loadJSONButton");
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const arrowSize = 10;
        let forces = [];
        let isDarkMode = false;

        

        function drawArrowhead(fromX, fromY, toX, toY) {
            const angle = Math.atan2(toY - fromY, toX - fromX);
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = "black";
            ctx.fill();
        }


         function drawCenterDot() {
            ctx.beginPath();
            ctx.arc(center.x, center.y, 3, 0, Math.PI * 2); // Draw a circle at the center
            ctx.fillStyle = "black"; // Set the fill color
            ctx.fill();
        }


        function drawForces() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const labelText = labelInput.value.trim();
    if (labelText) {
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(labelText, center.x, 20);
    }

    // Draw all forces
    forces.forEach(({ length, angle, label }) => {
        const radians = (angle * Math.PI) / 180;
        const endX = center.x + length * 30 * Math.cos(radians);
        const endY = center.y - length * 30 * Math.sin(radians);

        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = "black";
        ctx.stroke();

        drawArrowhead(
            center.x + length * 30 * 0.95 * Math.cos(radians),
            center.y - length * 30 * 0.95 * Math.sin(radians),
            endX,
            endY
        );

        const labelX = center.x + (length * 30 + 15) * Math.cos(radians);
        const labelY = center.y - (length * 30 + 15) * Math.sin(radians);
        ctx.font = "bold 14px Arial";
        ctx.fillText("F", labelX, labelY);
        ctx.font = "10px Arial";
        ctx.fillText(label, labelX + 8, labelY + 4);
    });

    // Draw the center dot
    drawCenterDot();
}


        function renderForceInputs() {
            forcesContainer.innerHTML = "";
            forces.forEach((force, i) => {
                const div = document.createElement("div");
                div.className = "force-input";
                div.innerHTML = `
                    <input type="number" min="1" max="10" step="0.1" value="${force.length}">
                    <input type="range" min="0" max="360" step="15" value="${force.angle}">
                    <span>${force.angle}°</span>
                    <input type="text" value="${force.label}" maxlength="16">
                `;
                div.querySelectorAll("input").forEach((input, idx) => {
                    input.addEventListener("input", () => {
                        if (idx === 0) force.length = parseFloat(input.value);
                        if (idx === 1) {
                            force.angle = parseInt(input.value);
                            div.querySelector("span").textContent = `${force.angle}°`;
                        }
                        if (idx === 2) {
                            force.label = input.value;
                        }
                        drawForces();
                    });
                });
                forcesContainer.appendChild(div);
            });
        }

        addForceButton.addEventListener("click", () => {
            forces.push({ length: 2, angle: 0, label: "F" });
            renderForceInputs();
            drawForces();
        });

        removeForceButton.addEventListener("click", () => {
            if (forces.length > 0) {
                forces.pop();
                renderForceInputs();
                drawForces();
            }
        });

        downloadButton.addEventListener("click", () => {
            const dataURL = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = dataURL;
            link.download = "force-map.png";
            link.click();
        });

        downloadJSONButton.addEventListener("click", () => {
            const blob = new Blob([JSON.stringify(forces)], { type: "application/json" });
            const link = document.createElement("a");
            link.download = "forces.json";
            link.href = URL.createObjectURL(blob);
            link.click();
        });

        uploadJSONInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file && file.type === "application/json") {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const json = JSON.parse(reader.result);
                        forces = json;
                        renderForceInputs();
                        drawForces();
                    } catch (error) {
                        alert("Failed to load JSON");
                    }
                };
                reader.readAsText(file);
            } else {
                alert("Please upload a valid JSON file.");
            }
        });


        infoButton.addEventListener("click", () => {
            infoPopup.style.display = "block";
        });

        closePopup.addEventListener("click", () => {
            infoPopup.style.display = "none";
        });

        // Close popup on outside click
        window.addEventListener("click", (e) => {
            if (e.target === infoPopup) {
                infoPopup.style.display = "none";
            }
        });

        labelInput.addEventListener("input", drawForces);

        darkModeToggle.addEventListener("click", () => {
            isDarkMode = !isDarkMode;
            document.body.classList.toggle("dark-mode", isDarkMode);
            darkModeToggle.textContent = isDarkMode ? "🌙" : "🌞";
            drawForces();
        });

        loadJSONButton.addEventListener("click", () => {
            try {
                const jsonData = JSON.parse(jsonInputField.value);
                forces = jsonData;
                renderForceInputs();
                drawForces();
            } catch (error) {
                alert("Invalid JSON format.");
            }
        });

        drawForces();
