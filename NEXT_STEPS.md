I have modified the `docker-compose.yml` file to include the `image` property for each service. This will ensure that the Docker images are built with the correct names that the `tag_and_push.ps1` script expects.

Now, you need to run the following commands in your terminal to build and push your images:

1.  **Build the images:**
    ```powershell
    docker-compose build
    ```

2.  **Push the images:**
    You will need your AWS ECR registry URL for this step.
    ```powershell
    .\scripts\tag_and_push.ps1 -Version <your_version> -RegistryUrl <your_ecr_registry_url>
    ```
    Replace `<your_version>` with the version you want to tag your images with (e.g., `v1.0.0`) and `<your_ecr_registry_url>` with your actual ECR registry URL.
