document.addEventListener('DOMContentLoaded', function() {
    const projectsLink = document.getElementById('projects-link');
    const projectsMenu = document.getElementById('projects-menu');

    if (projectsLink && projectsMenu) 
    {
        projectsLink.addEventListener('click', function(e) 
        {
            e.preventDefault();
            projectsMenu.classList.toggle('active');
        });

        document.addEventListener('click', function(e) 
        {
            // ugly but idk how else to prevent this from firing without the menu open
            if (projectsMenu.classList.contains('active') && 
                !projectsLink.contains(e.target) && 
                !projectsMenu.contains(e.target)) 
            {
                projectsMenu.classList.remove('active');
            }
        });
    }
});
