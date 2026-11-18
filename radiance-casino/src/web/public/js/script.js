document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveBtn');
    const toast = document.getElementById('toast');
    const gameRoleIdSelect = document.getElementById('gameRoleId');
    const gameCategoryIdSelect = document.getElementById('gameCategoryId');
    const adminRoleIdSelect = document.getElementById('adminRoleId');
    const leaderboardChannelIdSelect = document.getElementById('leaderboardChannelId');
    const ranksList = document.getElementById('ranksList');
    const originalBtnContent = saveBtn.innerHTML;

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> SAVING...';

        const guildId = window.location.pathname.split('/').pop();
        const gameRoleId = gameRoleIdSelect.value || null;
        const gameCategoryId = gameCategoryIdSelect.value || null;
        const adminRoleId = adminRoleIdSelect ? adminRoleIdSelect.value : null;
        const leaderboardChannelId = leaderboardChannelIdSelect ? leaderboardChannelIdSelect.value : null;
        const ranks = [];

        ranksList.querySelectorAll('tr').forEach((row, index) => {
            const rankName = row.querySelector('.fw-bold').textContent.trim();
            const threshold = parseInt(row.querySelector('.threshold-input').value) || 0;
            const maxBet = parseInt(row.querySelector('.maxbet-input').value) || 0;
            const roleId = row.querySelector('.rank-role-select').value || null;

            ranks.push({
                name: rankName,
                threshold: threshold,
                maxBet: maxBet,
                roleId: roleId
            });
        });

        const gameRooms = {};
        document.querySelectorAll('.game-room-select').forEach(select => {
            const game = select.id.replace('room-', '');
            gameRooms[game] = select.value || null;
        });

        try {
            const response = await axios.post(`/api/guild/${guildId}/settings`, {
                gameRoleId,
                gameCategoryId,
                adminRoleId,
                leaderboardChannelId,
                ranks,
                gameRooms
            });

            if (response.data.success) {
                showToast();
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error saving settings. Please check console for details.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnContent;
        }
    });

    function showToast() {
        toast.style.display = 'block';
        toast.classList.add('animate__animated', 'animate__fadeInUp');

        setTimeout(() => {
            toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
            setTimeout(() => {
                toast.style.display = 'none';
                toast.classList.remove('animate__animated', 'animate__fadeOutDown');
            }, 500);
        }, 3000);
    }
});
