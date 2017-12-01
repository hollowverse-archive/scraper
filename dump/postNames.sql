-- The query used to generate the corresponding JSON file

SELECT DISTINCT post_name
	FROM hollowverse.wp_posts
	WHERE post_type = "post" AND post_parent = 0 AND post_name != "" AND post_status="publish";
