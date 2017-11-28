SELECT post_name, post_parent, id, term_taxonomy_id, post_date_gmt
	FROM hollowverse.wp_posts
	LEFT JOIN hollowverse.wp_term_relationships
		ON wp_term_relationships.object_id = wp_posts.id 
	WHERE post_type="post";