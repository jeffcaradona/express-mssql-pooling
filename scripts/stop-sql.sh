#!/bin/bash

podman pod stop sqlserver-pod
podman pod rm sqlserver-pod
podman volume rm sqlserver-data