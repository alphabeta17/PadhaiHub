// frontend/src/js/main.js

async function handleSaveDetails() {
    const name = document.getElementById('name').value.trim();
    const university = document.getElementById('university').value.trim();
    const course = document.getElementById('course').value.trim();
    const sem = document.getElementById('sem').value.trim();
    const rollno = document.getElementById('rollno').value.trim();
    const address = document.getElementById('address').value.trim();
    const linkedin = document.getElementById('linkedin').value.trim();

    const email = localStorage.getItem("userEmail") || "test@gmail.com"; // Fallback for testing

    if (!name || !university || !course) {
        alert('Please fill out the primary fields (Name, University/College, Course)');
        return;
    }

    try {
        const response = await fetch('/api/auth/save-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullName: name, university, course, semester: sem, roll: rollno, address, linkedin })
        });

        const result = await response.json();
        if (result.success) {
            alert('Details Saved Successfully!');
            window.location.href = '/student/StudentDashboard.html';
        } else {
            alert(result.message || 'Failed to save details.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error while saving details.');
    }
}