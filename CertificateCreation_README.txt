# TO CREATE crt and key files:



# If you don't want your bot to be registered

1. Open shell/terminal, navigate to where you have bot code files saved, and run this command:
	openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out crt.pem







# If you want the bot's name to be registered (prevent other users from logging on with your bot's name)

1. First back up current mumble certificate
	1a. Log in to mumble like normal
	1b. Click Configure > Certificate Wizard
	1c. Check Export current certificate
	1d. Continue
	1e. Choose a location to save the file (and a filename) where you won't lose it 
		This is IMPORTANT if you have your normal name registered already. If you
		Don't do this, you won't be able to log back in with your normal name.
2. Next create a new certificate
	2a. Logout of mumble server and log back in with desired bot name.
	2b. Open Certificate Wizard again.
	2c. Check Create a new certificate
	2d. Continue
	2e. Add a name
	2f. Continue
	2g. Save that new certificate like you did in step one.
	2h. Register this bot's name: Self > Register
3. Reload your old name's certificate
	3a. Open Certificate Wizard
	3b. Check Import a certificate
	3c. Select the old certificate you created in step one.
	3d. You should be able to log in using your old name again.
4. Create .crt and .key files
	4a. Open a shell/terminal and navigate to the folder where you saved the new certificate from step 2
	4b. Run the following commands to create crt and key files (replace YOURCERTIFICATE.p12 with the actual file's name):
		openssl pkcs12 -in YOURCERTIFICATE.p12 -out key.pem -nocerts -nodes
		openssl pkcs12 -in YOURCERTIFICATE.p12 -out crt.pem -clcerts -nokeys
	4c. Copy the created crt and key files to where you have your bot code files stored.


